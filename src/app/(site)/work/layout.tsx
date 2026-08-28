/**
 * Work segment layout with a parallel `modal` slot.
 *
 * Opening /work/[slug] from the grid is intercepted into the slot, so the
 * grid page (and all of its filter/composition state) stays mounted beneath
 * the overlay, the URL updates with a real history entry, and browser Back
 * closes the overlay. Direct loads render the full case-study page instead.
 */
export default function WorkLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
