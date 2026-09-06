/**
 * PD-SAAS-FORK: Logo click → spacious single-page product overview (no scroll).
 */
import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import ProductInfoOverview from './ProductInfoOverview';
import '../theme/productInfoDialog.css';

type ProductInfoDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function ProductInfoDialog({ open, onClose }: ProductInfoDialogProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <motion.div
      className="product-info-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nova-product-info-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="product-info-panel"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97, y: reduceMotion ? 0 : 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ProductInfoOverview layout="dialog" onDismiss={onClose} />
      </motion.div>
    </motion.div>
  );
}
