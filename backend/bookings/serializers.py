from rest_framework import serializers
from .models import Booking, Member, Trainer
from .services import can_cancel


class TrainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trainer
        fields = ['trainer_id', 'full_name', 'specialization', 'working_hours', 'phone', 'photo']

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["member_id", "full_name", "phone", "email", "membership_status", "membership_end_date"]


class BookingSerializer(serializers.ModelSerializer):
    trainer_name = serializers.CharField(source="trainer.full_name", read_only=True)
    specialization = serializers.CharField(source="trainer.specialization", read_only=True)
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    amount_kzt = serializers.DecimalField(source="payment.amount_kzt", max_digits=10, decimal_places=2, read_only=True, default=None)
    payment_status = serializers.CharField(source="payment.payment_status", read_only=True, default=None)
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ["booking_id", "member_id", "member_name", "trainer_id", "trainer_name", "specialization",
                  "session_start", "status", "amount_kzt", "payment_status", "can_cancel"]

    def get_can_cancel(self, obj):
        return can_cancel(obj)
