/**
 * VerifySlide - Block puzzle slider captcha
 * Ported from Vue verifition/Verify/VerifySlide.vue
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { aesEncrypt } from './crypto';
import { reqGet, reqCheck } from './api';

export interface VerifySlideProps {
  captchaType: string;
  type?: string;
  mode?: 'pop' | 'fixed';
  vSpace?: number;
  explain?: string;
  imgSize?: { width: string; height: string };
  blockSize?: { width: string; height: string };
  barSize?: { width: string; height: string };
  onSuccess?: (result: { captchaVerification: string }) => void;
  onError?: () => void;
  onReady?: (instance: { refresh: () => void }) => void;
  parentClickShow?: boolean;
  onParentClose?: () => void;
}

interface SizeState {
  imgHeight: string;
  imgWidth: string;
  barHeight: string;
  barWidth: string;
}

export function VerifySlide({
  captchaType,
  type = '2',
  mode = 'fixed',
  vSpace = 5,
  explain = '向右滑动完成验证',
  imgSize = { width: '310px', height: '155px' },
  blockSize = { width: '50px', height: '50px' },
  barSize = { width: '310px', height: '40px' },
  onSuccess,
  onError,
  onReady,
  onParentClose,
}: VerifySlideProps) {
  const [secretKey, setSecretKey] = useState('');
  const [backImgBase, setBackImgBase] = useState('');
  const [blockBackImgBase, setBlockBackImgBase] = useState('');
  const [backToken, setBackToken] = useState('');
  const [tipWords, setTipWords] = useState('');
  const [text, setText] = useState(explain);
  const [finishText, setFinishText] = useState('');
  const [sizeState, setSizeState] = useState<SizeState>({
    imgHeight: '0',
    imgWidth: '0',
    barHeight: '0',
    barWidth: '0',
  });
  const [moveBlockLeft, setMoveBlockLeft] = useState<string | undefined>(undefined);
  const [leftBarWidth, setLeftBarWidth] = useState<string | undefined>(undefined);
  const [moveBlockBackgroundColor, setMoveBlockBackgroundColor] = useState<string | undefined>(
    undefined
  );
  const [leftBarBorderColor, setLeftBarBorderColor] = useState('#ddd');
  const [iconColor, setIconColor] = useState<string | undefined>(undefined);
  const [iconClass, setIconClass] = useState('icon-right');
  const [isEnd, setIsEnd] = useState(false);
  const [_showRefresh, setShowRefresh] = useState(true);
  const [transitionLeft, setTransitionLeft] = useState('');
  const [transitionWidth, setTransitionWidth] = useState('');
  const [passFlag, setPassFlag] = useState(false);

  const statusRef = useRef(false);
  const startLeftRef = useRef(0);
  const startMoveTimeRef = useRef(0);
  const endMovetimeRef = useRef(0);
  const barAreaRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Refs for values needed in handleEnd to avoid useCallback dependency churn
  const moveBlockLeftRef = useRef(0);
  const sizeStateRef = useRef({ imgWidth: '310px', imgHeight: '155px' });
  const secretKeyRef = useRef('');
  const backTokenRef = useRef('');
  const isEndRef = useRef(false);
  const onParentCloseRef = useRef<(() => void) | undefined>(undefined);
  const onSuccessRef = useRef<((result: { captchaVerification: string }) => void) | undefined>(
    undefined
  );
  const onErrorRef = useRef<(() => void) | undefined>(undefined);
  const modeRef = useRef(mode);
  const captchaTypeRef = useRef(captchaType);

  const resetSize = useCallback(() => {
    if (!containerRef.current) return;
    const parentWidth = containerRef.current.parentElement?.offsetWidth ?? window.innerWidth;
    const parentHeight = containerRef.current.parentElement?.offsetHeight ?? window.innerHeight;

    const parseSize = (size: string, parentDim: number): string => {
      if (size.includes('%')) {
        return `${(parseInt(size) / 100) * parentDim}px`;
      }
      return size;
    };

    setSizeState({
      imgWidth: parseSize(imgSize.width, parentWidth),
      imgHeight: parseSize(imgSize.height, parentHeight),
      barWidth: parseSize(barSize.width, parentWidth),
      barHeight: parseSize(barSize.height, parentHeight),
    });
  }, [imgSize, barSize]);

  // Sync refs with state/values to avoid useCallback dependency churn
  useEffect(() => {
    sizeStateRef.current = sizeState;
    secretKeyRef.current = secretKey;
    backTokenRef.current = backToken;
    isEndRef.current = isEnd;
    onParentCloseRef.current = onParentClose;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    modeRef.current = mode;
    captchaTypeRef.current = captchaType;
    // Parse the px string to a number for the ref
    moveBlockLeftRef.current = moveBlockLeft ? parseInt(moveBlockLeft) : 0;
  });

  const getPictrue = useCallback(async () => {
    try {
      const res = await reqGet({ captchaType });
      if (res.code === 0) {
        setBackImgBase(res.data?.originalImageBase64 ?? '');
        setBlockBackImgBase(res.data?.jigsawImageBase64 ?? '');
        setBackToken(res.data?.token ?? '');
        setSecretKey(res.data?.secretKey ?? '');
      } else {
        setTipWords(res.message ?? '加载失败');
      }
    } catch {
      setTipWords('网络错误');
    }
  }, [captchaType]);

  const refresh = useCallback(() => {
    setShowRefresh(true);
    setFinishText('');
    setTransitionLeft('left .3s');
    setMoveBlockLeft('0px');
    moveBlockLeftRef.current = 0;
    setLeftBarWidth(undefined);
    setTransitionWidth('width .3s');
    setLeftBarBorderColor('#ddd');
    setMoveBlockBackgroundColor('#fff');
    setIconColor('#000');
    setIconClass('icon-right');
    setIsEnd(false);
    isEndRef.current = false;
    getPictrue();
    setTimeout(() => {
      setTransitionWidth('');
      setTransitionLeft('');
      setText(explain);
    }, 300);
  }, [explain, getPictrue]);

  // Stable handleEnd - reads from refs to avoid dependency changes during drag
  const handleEnd = useCallback(() => {
    endMovetimeRef.current = Date.now();

    if (!statusRef.current || isEndRef.current) return;

    const moveLeftDistance = moveBlockLeftRef.current;
    const normalizedX = (moveLeftDistance * 310) / parseInt(sizeStateRef.current.imgWidth);

    const sk = secretKeyRef.current;
    const bt = backTokenRef.current;
    const ct = captchaTypeRef.current;

    const pointJson = sk
      ? aesEncrypt(JSON.stringify({ x: normalizedX, y: 5.0 }), sk)
      : JSON.stringify({ x: normalizedX, y: 5.0 });

    reqCheck({
      captchaType: ct,
      pointJson,
      token: bt,
    }).then((res: { code?: number }) => {
      if (res.code === 0) {
        setMoveBlockBackgroundColor('#5cb85c');
        setLeftBarBorderColor('#5cb85c');
        setIconColor('#fff');
        setIconClass('icon-check');
        setShowRefresh(false);
        setIsEnd(true);
        isEndRef.current = true;

        if (modeRef.current === 'pop') {
          setTimeout(() => {
            onParentCloseRef.current?.();
            refresh();
          }, 1500);
        }

        setPassFlag(true);
        const captchaVerification = sk
          ? aesEncrypt(`${bt}---${JSON.stringify({ x: normalizedX, y: 5.0 })}`, sk)
          : `${bt}---${JSON.stringify({ x: normalizedX, y: 5.0 })}`;

        setTipWords(
          `${((endMovetimeRef.current - startMoveTimeRef.current) / 1000).toFixed(2)}s验证成功`
        );
        setTimeout(() => {
          setTipWords('');
          onParentCloseRef.current?.();
          onSuccessRef.current?.({ captchaVerification });
        }, 1000);
      } else {
        setMoveBlockBackgroundColor('#d9534f');
        setLeftBarBorderColor('#d9534f');
        setIconColor('#fff');
        setIconClass('icon-close');
        setPassFlag(false);
        setTipWords('验证失败');
        setTimeout(() => {
          refresh();
          setTipWords('');
        }, 1000);
        onErrorRef.current?.();
      }
    });

    statusRef.current = false;
  }, [refresh]);

  // Stable handleMove
  const handleMove = useCallback(
    (clientX: number) => {
      if (!statusRef.current || isEndRef.current || !barAreaRef.current) return;

      const rect = barAreaRef.current.getBoundingClientRect();
      const barAreaLeft = rect.left;
      let blockLeft = clientX - barAreaLeft;

      const maxLeft = rect.width - parseInt(blockSize.width) / 2 - 2;
      if (blockLeft >= maxLeft) {
        blockLeft = maxLeft;
      }
      if (blockLeft <= parseInt(blockSize.width) / 2) {
        blockLeft = parseInt(blockSize.width) / 2;
      }

      const finalLeft = blockLeft - startLeftRef.current;
      moveBlockLeftRef.current = finalLeft;
      setMoveBlockLeft(`${finalLeft}px`);
      setLeftBarWidth(`${finalLeft}px`);
    },
    [blockSize.width]
  );

  // Stable handleStart
  const handleStart = useCallback((clientX: number) => {
    if (isEndRef.current) return;

    const rect = barAreaRef.current?.getBoundingClientRect();
    startMoveTimeRef.current = Date.now();
    startLeftRef.current = Math.floor(clientX - (rect?.left ?? 0));

    setText('');
    setMoveBlockBackgroundColor('#337ab7');
    setLeftBarBorderColor('#337AB7');
    setIconColor('#fff');
    statusRef.current = true;
  }, []);

  // Mouse/touch event handlers
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleStart(e.clientX);
    },
    [handleStart]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleStart(e.touches[0].clientX);
    },
    [handleStart]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [handleMove, handleEnd]);

  // Initialize
  useEffect(() => {
    setText(explain);
    getPictrue();
  }, [explain, getPictrue]);

  // Only run once on mount
  useEffect(() => {
    resetSize();
    onReady?.({ refresh });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Disable text selection
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.onselectstart = () => false;
    }
  }, []);

  // Store the bar element ref; getBoundingClientRect() is called at interaction time
  // to ensure we always read the latest dimensions.
  const handleBarRef = useCallback((el: HTMLDivElement | null) => {
    barAreaRef.current = el;
  }, []);

  const imgWidthNum = parseInt(sizeState.imgWidth);
  const subBlockWidth = `${Math.floor((imgWidthNum * 47) / 310)}px`;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {type === '2' && (
        <div className="verify-img-out" style={{ height: parseInt(sizeState.imgHeight) + vSpace }}>
          <div
            className="verify-img-panel"
            style={{ width: sizeState.imgWidth, height: sizeState.imgHeight }}
          >
            {backImgBase && (
              <img
                src={`data:image/png;base64,${backImgBase}`}
                alt=""
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            )}
            {tipWords && (
              <span
                className="verify-tips"
                style={{
                  backgroundColor: passFlag ? '#5cb85c' : '#d9534f',
                }}
              >
                {tipWords}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bar area */}
      <div
        ref={handleBarRef}
        className="verify-bar-area"
        style={{
          width: sizeState.imgWidth,
          height: barSize.height,
          lineHeight: barSize.height,
        }}
      >
        <span className="verify-msg">{text}</span>
        <div
          className="verify-left-bar"
          style={{
            width: leftBarWidth ?? barSize.height,
            height: barSize.height,
            borderColor: leftBarBorderColor,
            transition: transitionWidth,
          }}
        >
          <span className="verify-msg">{finishText}</span>
          <div
            className="verify-move-block"
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{
              width: barSize.height,
              height: barSize.height,
              backgroundColor: moveBlockBackgroundColor,
              left: moveBlockLeft,
              transition: transitionLeft,
              cursor: 'pointer',
              position: 'absolute',
              top: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              boxShadow: '0 0 3px rgba(0,0,0,0.3)',
              userSelect: 'none',
            }}
          >
            <span className="verify-icon" style={{ color: iconColor, fontSize: '18px' }}>
              {iconClass === 'icon-check'
                ? '\u2713'
                : iconClass === 'icon-close'
                  ? '\u2717'
                  : '\u279C'}
            </span>
            {type === '2' && blockBackImgBase && (
              <div
                className="verify-sub-block"
                style={{
                  width: subBlockWidth,
                  height: sizeState.imgHeight,
                  top: `-${parseInt(sizeState.imgHeight) + vSpace}px`,
                  backgroundSize: `${sizeState.imgWidth} ${sizeState.imgHeight}`,
                  position: 'absolute',
                }}
              >
                <img
                  src={`data:image/png;base64,${blockBackImgBase}`}
                  alt=""
                  style={
                    {
                      width: '100%',
                      height: '100%',
                      display: 'block',
                      WebkitUserDrag: 'none',
                    } as React.CSSProperties
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifySlide;
