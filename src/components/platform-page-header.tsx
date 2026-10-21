type Props = {
  title: string;
  description?: string;
};

/** Compact app header — keeps the composer footer visible on small screens. */
export function PlatformPageHeader({ title, description }: Props) {
  return (
    <header className="shrink-0 border-b border-white/8 px-4 py-2.5">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-base font-medium text-white sm:text-lg">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-xs text-white/45">{description}</p>
        ) : null}
      </div>
    </header>
  );
}
