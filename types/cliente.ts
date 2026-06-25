export interface Cliente {
  id: number;
  nombre: string;
  ruc: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  creado_por: string | null;
  creado_en: string;
}
