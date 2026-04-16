/**
 * VerifyPoints - Click word captcha
 * Ported from Vue verifition/Verify/VerifyPoints.vue
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { aesEncrypt } from './crypto';
import { reqGet, reqCheck } from './api';

export interface VerifyPointsProps {
  captchaType: string;
  mode?: 'pop' | 'fixed';
  vSpace?: number;
  imgSize?: { width: string; height: string };
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

interface Point {
  x: number;
  y: number;
}

export function VerifyPoints({
  captchaType,
  mode = 'fixed',
  vSpace = 5,
  imgSize = { width: '310px', height: '155px' },
  barSize = { width: '310px', height: '40px' },
  onSuccess,
  onError,
  onReady,
  onParentClose,
}: VerifyPointsProps) {
  const [secretKey, setSecretKey] = useState('');
  const [pointBackImgBase, setPointBackImgBase] = useState('');
  const [backToken, setBackToken] = useState('');
  const [_wordList, setWordList] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [barAreaColor, setBarAreaColor] = useState('#000');
  const [barAreaBorderColor, setBarAreaBorderColor] = useState('#ddd');
  const [bindingClick, setBindingClick] = useState(true);
  const [sizeState, setSizeState] = useState<SizeState>({
    imgHeight: '0',
    imgWidth: '0',
    barHeight: '0',
    barWidth: '0',
  });
  const [tempPoints, setTempPoints] = useState<Point[]>([]);

  const checkNumRef = useRef(3);
  const fontPosRef = useRef<Point[]>([]);
  const checkPosArrRef = useRef<Point[]>([]);
  const numRef = useRef(1);
  const canvasRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const pointTransform = useCallback(
    (pointArr: Point[]): Point[] => {
      return pointArr.map((p) => ({
        x: Math.round((310 * p.x) / parseInt(sizeState.imgWidth)),
        y: Math.round((155 * p.y) / parseInt(sizeState.imgHeight)),
      }));
    },
    [sizeState.imgWidth, sizeState.imgHeight]
  );

  const getPictrue = useCallback(async () => {
    try {
      const res = await reqGet({ captchaType });
      if (res.repCode === '0000') {
        setPointBackImgBase(res.repData?.originalImageBase64 ?? '');
        setBackToken(res.repData?.token ?? '');
        setSecretKey(res.repData?.secretKey ?? '');
        const wordList = res.repData?.wordList ?? [];
        setWordList(wordList);
        setText(`请依次点击【${wordList.join(', ')}】`);
      } else {
        setText(res.repMsg ?? '加载失败');
      }
    } catch {
      setText('网络错误');
    }
  }, [captchaType]);

  const refresh = useCallback(() => {
    setTempPoints([]);
    setBarAreaColor('#000');
    setBarAreaBorderColor('#ddd');
    setBindingClick(true);
    fontPosRef.current = [];
    checkPosArrRef.current = [];
    numRef.current = 1;
    setText('验证失败');
    getPictrue();
  }, [getPictrue]);

  const getMousePos = (e: React.MouseEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const createPoint = (pos: Point) => {
    setTempPoints((prev) => [...prev, { ...pos }]);
  };

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!bindingClick) return;

      const pos = getMousePos(e);
      checkPosArrRef.current.push(pos);

      if (numRef.current === checkNumRef.current) {
        createPoint(pos);

        // Transform coordinates
        const arr = pointTransform(checkPosArrRef.current);
        checkPosArrRef.current = arr;

        setTimeout(() => {
          const pointJson = secretKey
            ? aesEncrypt(JSON.stringify(checkPosArrRef.current), secretKey)
            : JSON.stringify(checkPosArrRef.current);

          const captchaVerification = secretKey
            ? aesEncrypt(`${backToken}---${JSON.stringify(checkPosArrRef.current)}`, secretKey)
            : `${backToken}---${JSON.stringify(checkPosArrRef.current)}`;

          reqCheck({
            captchaType,
            pointJson,
            token: backToken,
          }).then((res: { repCode?: string }) => {
            if (res.repCode === '0000') {
              setBarAreaColor('#4cae4c');
              setBarAreaBorderColor('#5cb85c');
              setText('验证成功');
              setBindingClick(false);

              if (mode === 'pop') {
                setTimeout(() => {
                  onParentClose?.();
                  refresh();
                }, 1500);
              }

              onSuccess?.({ captchaVerification });
            } else {
              onError?.();
              setBarAreaColor('#d9534f');
              setBarAreaBorderColor('#d9534f');
              setText('验证失败');
              setTimeout(() => {
                refresh();
              }, 700);
            }
          });
        }, 400);
      }

      if (numRef.current < checkNumRef.current) {
        createPoint(pos);
        numRef.current += 1;
      }
    },
    [
      bindingClick,
      pointTransform,
      secretKey,
      backToken,
      captchaType,
      mode,
      onParentClose,
      refresh,
      onSuccess,
      onError,
    ]
  );

  // Initialize
  useEffect(() => {
    fontPosRef.current = [];
    checkPosArrRef.current = [];
    numRef.current = 1;
    getPictrue();
  }, [getPictrue]);

  useEffect(() => {
    resetSize();
    onReady?.({ refresh });
  }, [resetSize, onReady]);

  // Disable text selection
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.onselectstart = () => false;
    }
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="verify-img-out">
        <div
          className="verify-img-panel"
          style={{
            width: sizeState.imgWidth,
            height: sizeState.imgHeight,
            backgroundSize: `${sizeState.imgWidth} ${sizeState.imgHeight}`,
            marginBottom: `${vSpace}px`,
          }}
        >
          {pointBackImgBase && (
            <img
              src={`data:image/png;base64,${pointBackImgBase}`}
              ref={canvasRef}
              alt=""
              style={{ width: '100%', height: '100%', display: 'block' }}
              onClick={bindingClick ? handleCanvasClick : undefined}
            />
          )}
          {tempPoints.map((tempPoint, index) => (
            <div
              key={index}
              className="point-area"
              style={{
                backgroundColor: '#1abd6c',
                color: '#fff',
                zIndex: 9999,
                width: '20px',
                height: '20px',
                textAlign: 'center',
                lineHeight: '20px',
                borderRadius: '50%',
                position: 'absolute',
                top: `${tempPoint.y - 10}px`,
                left: `${tempPoint.x - 10}px`,
              }}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>
      <div
        className="verify-bar-area"
        style={{
          width: sizeState.imgWidth,
          color: barAreaColor,
          borderColor: barAreaBorderColor,
          lineHeight: barSize.height,
          height: barSize.height,
        }}
      >
        <span className="verify-msg">{text}</span>
      </div>
    </div>
  );
}

export default VerifyPoints;
