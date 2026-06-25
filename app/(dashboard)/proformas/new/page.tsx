// app/(dashboard)/proformas/new/page.tsx
import { getClientes } from "@/services/cliente";
import NewProformaForm from "./NewProformaForm";

export default async function NewProformaPage() {
  const clientes = await getClientes();
  return <NewProformaForm clientes={clientes} />;
}
