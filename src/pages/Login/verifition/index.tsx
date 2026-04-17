/**
 * Verify - Captcha verification wrapper component
 * Dispatches to VerifySlide (blockPuzzle) or VerifyPoints (clickWord)
 * Ported from Vue verifition/Verify.vue
 */
import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { VerifySlide } from './VerifySlide';
import { VerifyPoints } from './VerifyPoints';
import "./verify.css"

export interface VerifyRef {
  refresh: () => void;
}

export interface VerifyProps {
  captchaType: 'blockPuzzle' | 'clickWord';
  figure?: number;
  arith?: number;
  mode?: 'pop' | 'fixed';
  vSpace?: number;
  explain?: string;
  imgSize?: { width: string; height: string };
  blockSize?: { width: string; height: string };
  barSize?: { width: string; height: string };
  onSuccess?: (result: { captchaVerification: string }) => void;
  onError?: () => void;
}

export const Verify = forwardRef<VerifyRef, VerifyProps>(function Verify(
  {
    captchaType,
    mode = 'pop',
    vSpace,
    explain,
    imgSize = { width: '310px', height: '155px' },
    blockSize,
    barSize,
    onSuccess,
    onError,
  }: VerifyProps,
  ref
) {
  const [clickShow, setClickShow] = useState(false);
  const instanceRef = useRef<{ refresh: () => void } | null>(null);

  useImperativeHandle(ref, () => ({
    refresh: () => instanceRef.current?.refresh(),
  }));

  const showBox = mode === 'pop' ? clickShow : true;

  const closeBox = useCallback(() => {
    setClickShow(false);
    instanceRef.current?.refresh();
  }, []);

  const handleReady = useCallback((instance: { refresh: () => void }) => {
    instanceRef.current = instance;
  }, []);

  const handleSuccess = useCallback(
    (result: { captchaVerification: string }) => {
      onSuccess?.(result);
    },
    [onSuccess]
  );

  const handleError = useCallback(() => {
    onError?.();
  }, [onError]);

  // Common props for both sub-components
  const commonProps = {
    mode,
    vSpace,
    imgSize,
    blockSize,
    barSize,
    onSuccess: handleSuccess,
    onError: handleError,
    onReady: handleReady,
    parentClickShow: clickShow,
    onParentClose: closeBox,
  };

  if (!showBox) {
    return null;
  }

  return (
    <div className={mode === 'pop' ? 'verify-mask' : ''}>
      <div className="verify-box" style={{ maxWidth: `${parseInt(imgSize.width) + 30}px` }}>
        {mode === 'pop' && (
          <div className="verify-box-top">
            <span>请完成安全验证</span>
            <span className="verify-box-close" onClick={closeBox}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ cursor: 'pointer' }}
              >
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
        )}
        <div className="verify-box-bottom" style={{ padding: mode === 'pop' ? '15px' : '0' }}>
          {captchaType === 'blockPuzzle' ? (
            <VerifySlide
              key={`slide-${clickShow ? 'open' : 'closed'}`}
              captchaType={captchaType}
              type="2"
              explain={explain}
              {...commonProps}
            />
          ) : captchaType === 'clickWord' ? (
            <VerifyPoints
              key={`points-${clickShow ? 'open' : 'closed'}`}
              captchaType={captchaType}
              {...commonProps}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});
