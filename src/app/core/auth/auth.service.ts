import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, AuthUser } from '../models/auth.models';
import { BehaviorSubject, catchError, finalize, Observable, of, shareReplay, tap, timeout } from 'rxjs';

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
        // bufferSize: 1 retiene la ultima emision para nuevos subscriptores
        // refCount: true hace que el observable subyacente solo se mantenga vivo mientras hay el menos un suscriptor
        //* Comparte la misma respuesta entre multiples subscriptores y evita repetir la peticion si ya se ha hecho
        shareReplay({bufferSize: 1, refCount: true}) // esto es para compartir la misma respuesta entre todas las suscripciones que se hagan mientras la petición está en curso, evitando así hacer múltiples peticiones de refresh si varios componentes se montan al mismo tiempo y detectan que el token ha expirado
      )

      return this.refreshRequest$;
  }

  /*
  * logout() debe hacer 3 cosas en el orden de importancia:
   1. Avisar al backend que invalide el token de la sesión (POST /auth/logout)
   2. Limpiar el estado loal y redirigir al login (siempre, pase lo que pase)
   3. Devolver Observable<void> para que el componente que llama pueda subscribirse y saber cuando termino

   **El truco** está en que la limpieza local debe ocurrir SIEMPRE, aunque el backend falle, tarde demasiado, o este caido. por eso se usa esta adena de opertadores.
  */
  logout(): Observable<void> {
    const token = this._accessToken();
    if(!token) {
      this.clearSessionAndRedirect();
      return of(void 0);
    }

    return this.http.post('/api/v1/auth/logout', {}, { headers:{ Authorization: `Bearer ${token}` }, withCredentials: true })
      .pipe(
        timeout({each: 3000}),
        catchError(() => of(void 0)), // Si la petición de logout falla por cualquier motivo (timeout, error de red, etc), igual se limpia la sesión y se redirige al login, porque el token ya no es válido o va a expirar pronto, así que no tiene sentido mantenerlo en el cliente
        finalize(() => this.clearSessionAndRedirect()), // una vez que la petición se completa (ya sea por éxito o por error), se limpia la sesión y se redirige al login
        tap(() => void 0) // esto es para transformar el resultado a void, ya que el backend no devuelve nada relevante en la respuesta de logout, y así el componente que llama solo recibe un Observable<void> sin necesidad de preocuparse por el tipo de respuesta del backend
      ) as Observable<void>;
  }



  private setSession(authResponse: AuthResponse): void {
    this._accessToken.set(authResponse.accessToken);
    this._currentUser.set(authResponse.user);
  }

  clearSessionAndRedirect(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
