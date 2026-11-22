import type { Metadata } from "next";
import { ButtonLink, EmptyState } from "@/components/UI";

export const metadata: Metadata = { title: "Sin conexión" };

/** What the service worker shows for a page it hasn't saved while there is no connection. */
export default function Offline() {
  return (
    <div className="pt-10">
      <EmptyState icon="📡" title="Sin conexión">
        Esta página todavía no está guardada en el dispositivo. Las lecciones, la práctica y el diccionario de
        tu vocabulario funcionan sin conexión; las cuentas necesitan internet.
      </EmptyState>
      <ButtonLink href="/" full>
        Volver al inicio
      </ButtonLink>
    </div>
  );
}
