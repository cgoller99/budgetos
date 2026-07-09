let modalLockCount = 0;

export function lockBodyScroll(): void {
  modalLockCount += 1;
  document.body.style.overflow = "hidden";
}

export function unlockBodyScroll(): void {
  modalLockCount = Math.max(0, modalLockCount - 1);

  if (modalLockCount === 0) {
    document.body.style.overflow = "";
  }
}
