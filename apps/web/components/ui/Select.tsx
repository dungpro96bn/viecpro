'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/format';
import { IconCheck, IconChevronDown } from './Icons';
import './select.css';

export type SelectOption = string | number | { value: string; label: string };

interface SelectProps {
  options: SelectOption[];
  /** Tên trường khi gửi form (render input ẩn) */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Chữ mờ hiển thị khi chưa chọn (value rỗng), không nằm trong danh sách */
  placeholder?: string;
  required?: boolean;
  /** Class của nút bấm – giữ nguyên kiểu ô cũ (field-input, search-bar__input…) */
  className?: string;
  'aria-label'?: string;
}

const norm = (o: SelectOption) => (typeof o === 'object' ? o : { value: String(o), label: String(o) });

/**
 * Dropdown thay cho <select>: menu tự vẽ (portal ra body, không bị overflow cắt),
 * theo mẫu ARIA "select-only combobox".
 */
export default function Select({ options, name, value, defaultValue, onChange, placeholder, required, className, 'aria-label': ariaLabel }: SelectProps) {
  const items = options.map(norm);
  const [inner, setInner] = useState(defaultValue ?? (placeholder ? '' : items[0]?.value ?? ''));
  const current = value ?? inner;
  const selectedIndex = items.findIndex((o) => o.value === current);
  const selected = items[selectedIndex];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  /** Chỉ tự cuộn tới mục active khi mở menu hoặc dùng bàn phím – không khi rê chuột / đang cuộn */
  const scrollToActive = useRef(false);
  const id = useId();

  const choose = (i: number) => {
    const v = items[i].value;
    if (value === undefined) setInner(v);
    if (v !== current) onChange?.(v);
    setOpen(false);
  };

  const openMenu = (index = selectedIndex) => {
    scrollToActive.current = true;
    setActive(Math.max(0, index));
    setOpen(true);
  };

  // Đặt vị trí menu theo nút; lật lên trên nếu phía dưới không đủ chỗ
  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 6;
    const below = window.innerHeight - r.bottom - gap - 8;
    const above = r.top - gap - 8;
    const width = Math.min(Math.max(r.width, 200), window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const next =
      below < 220 && above > below
        ? { left, bottom: window.innerHeight - r.top + gap, width, maxHeight: Math.min(320, above) }
        : { left, top: r.bottom + gap, width, maxHeight: Math.min(320, below) };
    // Không đổi thì giữ object cũ để tránh render lại
    setPos((prev) =>
      prev && prev.left === next.left && prev.top === next.top && prev.bottom === next.bottom && prev.width === next.width && prev.maxHeight === next.maxHeight
        ? prev
        : next,
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Bỏ qua cuộn bên trong chính menu, chỉ bám theo khi trang / khung cha cuộn
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      place();
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Đưa mục active vào tầm nhìn (khi mở menu / điều hướng bằng bàn phím)
  useEffect(() => {
    if (!open || !pos || !scrollToActive.current) return;
    scrollToActive.current = false;
    const menu = menuRef.current;
    const item = menu?.children[active] as HTMLElement | undefined;
    if (!menu || !item) return;
    // Tự tính thay vì scrollIntoView để không kéo theo cuộn cả trang
    if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop - 6;
    else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight + 6;
  }, [open, active, pos]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = items.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      if (!open) return openMenu();
      scrollToActive.current = true;
      setActive(Math.min(last, Math.max(0, i)));
    };
    switch (e.key) {
      case 'ArrowDown': return move(active + 1);
      case 'ArrowUp': return move(active - 1);
      case 'Home': return open && move(0);
      case 'End': return open && move(last);
      case 'PageDown': return open && move(active + 8);
      case 'PageUp': return open && move(active - 8);
      case 'Enter':
      case ' ':
        e.preventDefault();
        return open ? choose(active) : openMenu();
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // không đóng luôn popup cha (modal)
          setOpen(false);
        }
        return;
      case 'Tab':
        if (open) choose(active);
        return;
    }
    // Gõ chữ để nhảy tới mục bắt đầu bằng chữ đó
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at > 600 ? '' : typed.current.text) + e.key.toLowerCase(), at: now };
      const from = open ? active : Math.max(0, selectedIndex);
      const order = [...items.slice(from + 1), ...items.slice(0, from + 1)];
      const hit = order.find((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit) {
        const i = items.indexOf(hit);
        if (open) {
          scrollToActive.current = true;
          setActive(i);
        } else choose(i);
      }
    }
  };

  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <span className="select">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        className={cx('select__trigger', className, open && 'select__trigger--open')}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={cx('select__value', !selected && 'select__value--placeholder')}>{selected?.label ?? placeholder}</span>
        <IconChevronDown size={16} className="icon--w22 select__chevron" />
      </button>

      {/* Input thật (ẩn) để form gửi dữ liệu và trình duyệt kiểm tra "required" */}
      {name && (
        <input
          className="select__native"
          name={name}
          value={current}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          onChange={() => {}}
          onInvalid={() => triggerRef.current?.focus()}
        />
      )}

      {open &&
        pos &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className={cx('select__menu', pos.bottom !== undefined && 'select__menu--up')}
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
          >
            {items.map((o, i) => (
              <li
                key={o.value + i}
                id={optionId(i)}
                role="option"
                aria-selected={o.value === current}
                className={cx('select__option', i === active && 'select__option--active', o.value === current && 'select__option--selected')}
                onPointerMove={(e) => e.pointerType === 'mouse' && i !== active && setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // giữ focus ở nút
                onClick={() => {
                  choose(i);
                  triggerRef.current?.focus();
                }}
              >
                <span className="select__option-label">{o.label}</span>
                {o.value === current && <IconCheck size={16} className="icon--w24 select__check" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </span>
  );
}
