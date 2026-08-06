import { createFileRoute } from "@tanstack/react-router";
import PosApp from "@/pos/PosApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upcoming POS — Restaurant & Event Order System" },
      {
        name: "description",
        content:
          "Restaurant POS with table ordering, event reservations, banquet bookings and an event reservation report.",
      },
      { property: "og:title", content: "Upcoming POS — Restaurant & Event Order System" },
      {
        property: "og:description",
        content:
          "Take orders, manage tables, book banquet events and run event reservation reports from one POS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PosApp,
});
