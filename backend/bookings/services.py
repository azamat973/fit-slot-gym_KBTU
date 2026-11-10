"""Business rules for booking. Views only call these functions."""
from datetime import datetime, timedelta
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.utils import timezone
from .models import Booking, Payment

SESSION_PRICE = Decimal("5000")
CANCEL_BEFORE_HOURS = 2


class BookingError(Exception):
    def __init__(self, code, message, http_status, extra=None):
        super().__init__(message)
        self.code, self.message, self.http_status, self.extra = code, message, http_status, extra or {}

    def payload(self):
        return {"error": self.code, "message": self.message, **self.extra}


def day_slots(trainer, day):
    """Hourly slot start times inside the trainer's working hours."""
    start_t, end_t = trainer.hours()
    cur, end = datetime.combine(day, start_t), datetime.combine(day, end_t)
    slots = []
    while cur + timedelta(hours=1) <= end:
        slots.append(cur)
        cur += timedelta(hours=1)
    return slots


def taken_slots(trainer, day):
    qs = Booking.objects.filter(trainer=trainer, session_start__date=day).exclude(status="Cancelled")
    return {b.session_start for b in qs}


def slots_for_day(trainer, day):
    """List of {time, available} for one day."""
    now, taken = timezone.now(), taken_slots(trainer, day)
    return [{"time": s.strftime("%H:%M"), "available": s not in taken and s > now} for s in day_slots(trainer, day)]


def nearest_free(trainer, start, limit=3):
    now, found, day = timezone.now(), [], start.date()
    for _ in range(7):
        taken = taken_slots(trainer, day)
        for s in day_slots(trainer, day):
            if s > start and s > now and s not in taken:
                found.append(s.strftime("%Y-%m-%d %H:%M"))
                if len(found) == limit:
                    return found
        day += timedelta(days=1)
    return found


@transaction.atomic
def create_booking(member, trainer, start, method="Card", simulate_payment_failure=False):
    """Booking + payment in ONE transaction. Any error undoes everything."""
    if member.membership_status != "Active":
        raise BookingError("membership_inactive", "Your membership is not active.", 403)
    if start <= timezone.now():
        raise BookingError("past_time", "Choose a time in the future.", 422)
    if start.minute or start.second:
        raise BookingError("invalid_time", "Sessions start at a full hour.", 422)
    t_start, t_end = trainer.hours()
    if start.time() < t_start or start + timedelta(hours=1) > datetime.combine(start.date(), t_end):
        raise BookingError("outside_hours", f"Trainer works {trainer.working_hours}.", 422)
    try:
        with transaction.atomic():
            booking = Booking.objects.create(member=member, trainer=trainer, session_start=start, status="Confirmed")
    except IntegrityError:
        raise BookingError("slot_taken", "This time is already booked. Pick another slot.", 409,
                           {"alternatives": nearest_free(trainer, start)})
    Payment.objects.create(booking=booking, amount_kzt=SESSION_PRICE, payment_method=method,
                           payment_status="Paid", paid_at=timezone.now())
    if simulate_payment_failure:     # demo of an atomic transaction: booking is rolled back
        raise BookingError("payment_failed", "Payment failed. Booking was rolled back.", 402)
    return booking


def can_cancel(booking):
    return booking.status == "Confirmed" and booking.session_start - timezone.now() >= timedelta(hours=CANCEL_BEFORE_HOURS)


def cancel_booking(booking):
    if booking.status != "Confirmed":
        raise BookingError("not_cancellable", "Only confirmed bookings can be cancelled.", 422)
    if not can_cancel(booking):
        raise BookingError("cancel_too_late", f"Cancel at least {CANCEL_BEFORE_HOURS} hours before the session.", 403)
    booking.status = "Cancelled"
    booking.save(update_fields=["status"])
    return booking
