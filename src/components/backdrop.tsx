// Soft blue-grey blobs that drift slowly (and parallax with scroll) behind the glass.
export function Backdrop() {
  return (
    <div className="bg" aria-hidden>
      <i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" /><i className="b5" /><i className="b6" />
    </div>
  );
}
