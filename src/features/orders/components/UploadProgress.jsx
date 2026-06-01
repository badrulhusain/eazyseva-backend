import React from 'react';

const statusConfig = {
  idle: {
    label: 'Not uploaded',
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  uploading: {
    label: 'Uploading',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  uploaded: {
    label: 'Uploaded',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 ring-red-200',
  },
};

export default function UploadProgress({ status = 'idle', progress = 0 }) {
  const config = statusConfig[status] ?? statusConfig.idle;
  const showProgress = status === 'uploading';

  return (
    <div className="flex min-w-[8rem] flex-col items-end gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${config.className}`}
      >
        {config.label}
      </span>

      {showProgress ? (
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
