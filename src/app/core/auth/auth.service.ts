import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, AuthUser } from '../models/auth.models';
import { BehaviorSubject, finalize, Observable, shareReplay, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _accessToken = signal<string | null>(null);
  private readonly _currentUser = signal<AuthUser | null>(null);

  private refreshRequest$: Observable<AuthResponse> | null = null;

  private readonly _isRefreshing$ = new BehaviorSubject<boolean>(false);

  // Esto es para exponer el valor de _isRefreshing$ como un observable, para que los componentes puedan suscribirse a el y saber si se está haciendo una petición de refresh
  readonly isRefreshing$ = this._isRefreshing$.asObservable();
  readonly accessToken$ = this._accessToken.asReadonly();
  readonly currentUser$ = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
  readonly isDoctor = computed(() => this._currentUser()?.role === 'doctor');
  readonly isPatient = computed(() => this._currentUser()?.role === 'patient');

  //* Helper: expone el valor sincrono del gate para consultas rápidas desde el interceptor antes de decir si encolar o disparar el refresh
  isResfreshing(): boolean {
    return this._isRefreshing$.getValue();
  }

  login(email: string, password: string):Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/login', { email, password}, { withCredentials: true })
    .pipe(tap(authResponse => this.setSession(authResponse)));
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/register', { email, password }, { withCredentials: true })
    .pipe(tap(authResponse => this.setSession(authResponse)));
  }

  refresh():Observable<AuthResponse> {
    if(this.refreshRequest$) return this.refreshRequest$; // si hay una petición en curso, devuelve esa misma petición
    this._isRefreshing$.next(true); // indica que se está haciendo una petición de refresh, para que los componentes puedan reaccionar a eso
    this.refreshRequest$ = this.http.post<AuthResponse>('/api/v1/auth/refresh', {}, { withCredentials: true })
      .pipe(
        tap(responseRefresh => this.setSession(responseRefresh)),
        finalize(() => {
          this.refreshRequest$ = null; // una vez que la petición se completa, se resetea la variable para permitir futuras peticiones de refresh
          this._isRefreshing$.next(false); // indica que ya no se está haciendo una petición de refresh
        }),
        shareReplay({bufferSize: 1, refCount: true}) // esto es para compartir la misma respuesta entre todas las suscripciones que se hagan mientras la petición está en curso, evitando así hacer múltiples peticiones de refresh si varios componentes se montan al mismo tiempo y detectan que el token ha expirado
      )

      return this.refreshRequest$;
  }

  private setSession(authResponse: AuthResponse): void {
    this._accessToken.set(authResponse.accessToken);
    this._currentUser.set(authResponse.user);
  }
}
