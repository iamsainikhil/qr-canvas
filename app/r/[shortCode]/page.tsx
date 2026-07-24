import { redirect } from 'next/navigation';

export default function ShortCodePage({
  params,
  searchParams,
}: {
  params: { shortCode: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null) qs.append(key, item);
      });
      continue;
    }

    if (value != null) qs.set(key, value);
  }

  qs.set('shortCode', params.shortCode);
  redirect(`/api/redirect?${qs.toString()}`);
}
