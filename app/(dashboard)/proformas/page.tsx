import { getProformas } from "@/services/proformas";
import { getClientes } from "@/services/cliente";
import ProformasClient from "./ProformasClient";

export default async function ProformasPage() {
  const [proformas, clientes] = await Promise.all([
    getProformas(),
    getClientes(),
  ]);

  return <ProformasClient proformas={proformas} clientes={clientes} />;
}
