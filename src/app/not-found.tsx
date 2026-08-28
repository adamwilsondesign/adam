import { NotFoundView } from "@/components/NotFoundView";

export const metadata = {
  title: "Not found",
  robots: { index: false },
};

export default function NotFound() {
  return <NotFoundView />;
}
