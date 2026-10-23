import type { Metadata } from "next";
import SeriesList from "./SeriesList";

export const metadata: Metadata = { title: "مجموعاتي" };

export default function Subscriptions() {
  return (
    <>
      <h1 className="page-title">مجموعاتي</h1>
      <SeriesList />
    </>
  );
}
