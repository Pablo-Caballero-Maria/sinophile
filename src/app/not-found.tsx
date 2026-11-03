import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="pt-10">
      <EmptyState icon="🧭" title="Página no encontrada">
        Esta página no existe. 迷路了？
      </EmptyState>
      <ButtonLink href="/" full>
        Volver al inicio
      </ButtonLink>
    </div>
  );
}
