import { NotFoundView } from "@/components/NotFoundView";

/** 404 boundary for site routes — unknown or unpublished case-study slugs land here. */
export default function SiteNotFound() {
  return <NotFoundView />;
}
