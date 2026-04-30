import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ApiKeysProvider } from "../apiKeys.js";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ApiKeysProvider>
      <Outlet />
    </ApiKeysProvider>
  );
}
