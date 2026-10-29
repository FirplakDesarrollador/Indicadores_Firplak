import CargaView from "@/app/components/CargaView";

export const metadata = {
  title: "Capacidad & WIPL | Firplak",
  description: "Monitoreo de Capacidad Operativa y Límite WIPL en Planner.",
};

export default function CargaPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f7f8", padding: "20px 28px" }}>
      <CargaView />
    </main>
  );
}

