export default function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="banner banner-error" role="alert">
      {message}
    </div>
  );
}
