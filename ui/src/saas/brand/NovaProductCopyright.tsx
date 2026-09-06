/** PD-SAAS-FORK: Shared © line for login footer and product info dialog. */
import { formatNovaProductCopyright } from './productInfo';

type NovaProductCopyrightProps = {
  className?: string;
};

export default function NovaProductCopyright({ className }: NovaProductCopyrightProps) {
  return <p className={className}>{formatNovaProductCopyright()}</p>;
}
