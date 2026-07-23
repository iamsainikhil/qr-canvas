import Error from '@/views/Error';

const qrReasonMap: Record<string, string> = {
  not_found: 'qr_not_found',
  disabled: 'qr_disabled',
  error: 'qr_error',
  invalid: 'qr_invalid',
};

export default function ErrorPageRoute({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const reasonValue = searchParams.reason;
  const reason = Array.isArray(reasonValue) ? reasonValue[0] : reasonValue;
  const normalizedReason = reason ? qrReasonMap[reason] ?? 'qr_error' : 'qr_error';

  return <Error reason={normalizedReason} />;
}
