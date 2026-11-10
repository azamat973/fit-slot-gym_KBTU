import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ApiError, Booking } from '../core/models';
import { ToastService } from '../core/toast.service';
import { AuthService } from '../core/auth.service';

type Tab = 'upcoming' | 'past' | 'cancelled';

@Component({
  selector: 'app-my-bookings',
  imports: [DatePipe, RouterLink],
  template: `
  <div class="row between">
    <h2>My bookings</h2>
    <a class="btn btn-primary" routerLink="/book">+ New booking</a>
  </div>

  <div class="row mt-s" style="margin-top: 24px;">
    @for (t of tabs; track t) {
      <button class="chip" [class.on]="tab() === t" (click)="tab.set(t)">{{ t }} ({{ count(t) }})</button>
    }
  </div>

  <div class="grid mt">
    @for (b of shown(); track b.booking_id) {
      <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
        <div class="row between" style="align-items: flex-start;">
          <div>
            <h3>{{ b.trainer_name }} <span class="badge b-{{ b.status }}">{{ b.status }}</span></h3>
            <p>{{ b.session_start | date: 'EEEE d MMMM, HH:mm' }} · {{ b.specialization }}</p>
            <p style="font-size:.85rem; color: #94a3b8;">Booking ID: {{ b.booking_id }} · {{ b.amount_kzt }} KZT <span class="badge b-{{ b.payment_status }}">{{ b.payment_status }}</span></p>
          </div>
          @if (b.status === 'Confirmed') {
            <button class="btn btn-danger" [disabled]="!b.can_cancel" (click)="cancel(b)"
              [title]="b.can_cancel ? '' : 'Cancel at least 2 hours before the session'">Cancel</button>
          }
        </div>

        <!-- Егер бронь расталған (Confirmed) болса, сол сеансқа арналған жеке QR-код шығады -->
        @if (b.status === 'Confirmed') {
          <div style="background: rgba(15, 23, 42, 0.4); padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 16px; border: 1px dashed var(--border-color);">
            <div style="background: white; padding: 6px; border-radius: 6px;">
              <img 
                [src]="'https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=SessionPass-' + b.booking_id" 
                alt="Session QR Pass" 
                style="display: block; width: 90px; height: 90px;"
              />
            </div>
            <div>
              <p style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Сеансқа кіру QR-коды</p>
              <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.4;">Залдың турникетінде осы жеке кодты сканерлеңіз. Код тек осы тренировкаға ғана жарамды.</p>
            </div>
          </div>
        }
      </div>
    } @empty { <div class="card muted">{{ loaded() ? 'Nothing here yet.' : 'Loading…' }}</div> }
  </div>`
})
export class MyBookingsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  tabs: Tab[] = ['upcoming', 'past', 'cancelled'];
  tab = signal<Tab>('upcoming');
  all = signal<Booking[]>([]);
  loaded = signal(false);
  shown = computed(() => this.filter(this.tab()));

  ngOnInit() { this.load(); }

  load() { this.api.myBookings().subscribe(b => { this.all.set(b); this.loaded.set(true); }); }

  private filter(t: Tab) {
    const now = Date.now();
    return this.all().filter(b => {
      const future = new Date(b.session_start).getTime() > now;
      if (t === 'cancelled') return b.status === 'Cancelled';
      if (t === 'upcoming') return b.status === 'Confirmed' && future;
      return b.status === 'Completed' || (b.status === 'Confirmed' && !future);
    });
  }
  count(t: Tab) { return this.filter(t).length; }

  cancel(b: Booking) {
    this.api.cancelBooking(b.booking_id).subscribe({
      next: () => { this.toast.show('Booking cancelled', 'success'); this.load(); },
      error: (e: HttpErrorResponse) => this.toast.show((e.error as ApiError)?.message ?? 'Could not cancel', 'error')
    });
  }
}