import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 font-sans">
      <div className="max-w-md text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          ERR / 404
        </div>
        <h1 className="mt-4 text-7xl font-bold font-mono text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O recurso solicitado não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Petri-IEC — Conversor de Redes de Petri para IEC 61131-3" },
      {
        name: "description",
        content:
          "Ambiente técnico para conversão de redes de Petri (.npml) em código estruturado IEC 61131-3.",
      },
      { name: "author", content: "Petri-IEC" },
      { property: "og:title", content: "Petri-IEC — Conversor para IEC 61131-3" },
      {
        property: "og:description",
        content: "Conversor de redes de Petri para código estruturado IEC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          },
        }}
      />
    </>
  );
}
