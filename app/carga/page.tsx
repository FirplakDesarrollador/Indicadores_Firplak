import CargaView from "@/app/components/CargaView";

export const metadata = {
  title: "Dashboard de Gestión | Firplak",
  description: "Desempeño del personal, control de capacidad operativa y límites WIPL en Planner.",
};

export default function CargaPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f7f8", padding: "20px 28px" }}>
      <CargaView />
    </main>
  );
}

