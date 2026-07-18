export class AccountOutputDto {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  name: string;

  initialBalance: number;

  currency: string;

  /** Saldo vivo = initialBalance + suma firmada de movimientos. Se adjunta al
   * listar/leer cuentas; ausente en respuestas que no lo calculan (ej. alta). */
  balance?: number;

  user: number;
}
