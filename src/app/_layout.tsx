import { Stack } from "expo-router";
import { AppProvider } from "../../App";

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade_from_bottom",
          contentStyle: { backgroundColor: "#101715" },
        }}
      />
    </AppProvider>
  );
}
