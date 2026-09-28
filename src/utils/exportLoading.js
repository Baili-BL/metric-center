export async function runWithExportLoading(task) {
  if (typeof document === 'undefined') return task()
  let el = document.querySelector('.xlsx-export-loading')
  if (!el) {
    el = document.createElement('div')
    el.className = 'xlsx-export-loading'
    el.innerHTML = '<i class="xlsx-export-spin" aria-hidden="true"></i><span>正在导出表格，请稍候...</span>'
    document.body.appendChild(el)
  }
  el.classList.add('show')
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  try {
    return await task()
  } finally {
    el.classList.remove('show')
    window.setTimeout(() => {
      if (!el.classList.contains('show')) el.remove()
    }, 200)
  }
}
