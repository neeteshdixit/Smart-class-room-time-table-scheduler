const fs = require('fs');
const code = `
export function DeleteConfirmationModal({ isOpen, onClose, onConfirm, title, description, isDeleting }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={!isDeleting ? onClose : undefined}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-white">{title || 'Confirm Deletion'}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {description || 'Are you sure you want to delete this record? This action cannot be undone.'}
                </p>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={onConfirm} disabled={isDeleting} className="min-w-[100px]">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
`;

fs.appendFileSync('src/components/ui.jsx', code, 'utf8');
