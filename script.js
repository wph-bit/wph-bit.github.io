/**
 * 个人学术主页交互脚本
 * ---------------------------------------------------------------------------
 * 这里只使用原生 JavaScript，不依赖任何第三方库。主要功能包括：
 * 1. 手机端导航菜单的开合、点击外部关闭、按 Escape 关闭；
 * 2. 点击导航链接时平滑滚动到对应区域；
 * 3. 根据滚动位置高亮当前章节；
 * 4. 滚动后显示“返回顶部”按钮；
 * 5. 尊重系统的“减少动态效果”偏好。
 */

(() => {
  "use strict";

  // -------------------------------------------------------------------------
  // 1. 缓存页面元素
  // 修改页面结构时，请保持这些 id / class 与 HTML 中一致。
  // -------------------------------------------------------------------------
  const header = document.getElementById("site-header");
  const navToggle = document.getElementById("nav-toggle");
  const navigation = document.getElementById("primary-navigation");
  const backToTop = document.getElementById("back-to-top");
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));

  // 如果关键结构不存在，就停止执行，避免控制台报错。
  if (!header || !navToggle || !navigation) {
    return;
  }

  // 将每个导航链接与对应 section 配对，后续用于滚动高亮。
  const navTargets = navLinks
    .map((link) => {
      const href = link.getAttribute("href");
      const section = href ? document.querySelector(href) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  // 系统是否开启了“减少动态效果”。用户点击时再读取 matches，保证设置变化能生效。
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  // 桌面端断点需要与 CSS 中的 820px 保持一致。
  const desktopQuery = window.matchMedia("(min-width: 821px)");

  // -------------------------------------------------------------------------
  // 2. 手机端导航菜单
  // -------------------------------------------------------------------------

  /**
   * 设置移动端菜单的开合状态。
   * @param {boolean} isOpen - true 为打开，false 为关闭。
   */
  const setMenuState = (isOpen) => {
    navigation.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  };

  navToggle.addEventListener("click", () => {
    const isCurrentlyOpen = navToggle.getAttribute("aria-expanded") === "true";
    setMenuState(!isCurrentlyOpen);
  });

  // 点击菜单以外的区域时自动收起菜单。
  document.addEventListener("click", (event) => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    if (!isOpen || header.contains(event.target)) {
      return;
    }

    setMenuState(false);
  });

  // 键盘用户按 Escape 关闭菜单，并把焦点还给菜单按钮。
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (navToggle.getAttribute("aria-expanded") === "true") {
      setMenuState(false);
      navToggle.focus();
    }
  });

  // 当窗口放大到桌面尺寸时，关闭移动菜单，避免状态残留。
  const handleDesktopChange = (event) => {
    if (event.matches) {
      setMenuState(false);
    }
  };

  if (typeof desktopQuery.addEventListener === "function") {
    desktopQuery.addEventListener("change", handleDesktopChange);
  } else {
    // 兼容较旧的 Safari。
    desktopQuery.addListener(handleDesktopChange);
  }

  // -------------------------------------------------------------------------
  // 3. 平滑滚动
  // -------------------------------------------------------------------------
  // 选取页面内部锚点链接；跳过“跳到正文”链接，让它保留浏览器原生的焦点行为。
  const anchorLinks = document.querySelectorAll('a[href^="#"]:not(.skip-link)');

  anchorLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");

      // 空锚点（例如暂未设置真实地址的 Download CV）保持默认行为。
      if (!href || href === "#") {
        return;
      }

      let target = null;
      try {
        target = document.querySelector(href);
      } catch (error) {
        // 如果 href 不是合法选择器，就交给浏览器处理。
        return;
      }

      if (!target) {
        return;
      }

      event.preventDefault();
      setMenuState(false);

      target.scrollIntoView({
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
        block: "start",
      });

      // 更新地址栏但不触发浏览器的二次跳转。修改地址栏失败时也不会影响滚动。
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", href);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 4. 滚动时更新导航高亮、导航栏阴影和返回顶部按钮
  // -------------------------------------------------------------------------

  /**
   * 根据当前滚动位置找出正在阅读的章节，并同步导航状态。
   */
  const updateActiveSection = () => {
    if (navTargets.length === 0) {
      return;
    }

    // 预留导航栏高度，再加上一点缓冲区，让章节标题进入视口时就切换高亮。
    const activationLine =
      window.scrollY + header.offsetHeight + Math.min(window.innerHeight * 0.25, 180);

    let activeTarget = navTargets[0];

    navTargets.forEach((target) => {
      if (target.section.offsetTop <= activationLine) {
        activeTarget = target;
      }
    });

    // 滚动到页面底部时，强制高亮最后一个 Contact 章节。
    const isAtPageBottom =
      Math.ceil(window.scrollY + window.innerHeight) >=
      document.documentElement.scrollHeight - 2;

    if (isAtPageBottom) {
      activeTarget = navTargets[navTargets.length - 1];
    }

    navTargets.forEach(({ link, section }) => {
      const isActive = section === activeTarget.section;

      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  /**
   * 处理所有与滚动位置相关的界面状态。
   */
  const updateScrollUi = () => {
    const currentScroll = window.scrollY || window.pageYOffset;

    // 页面离开顶部后，导航栏出现细边框和阴影。
    header.classList.toggle("is-scrolled", currentScroll > 8);

    // 滚动超过 640px 后显示返回顶部按钮。
    if (backToTop) {
      backToTop.hidden = currentScroll < 640;
    }

    updateActiveSection();
  };

  // 使用 requestAnimationFrame 合并高频 scroll 事件，减少主线程压力。
  let scrollFramePending = false;

  const requestScrollUpdate = () => {
    if (scrollFramePending) {
      return;
    }

    scrollFramePending = true;
    window.requestAnimationFrame(() => {
      updateScrollUi();
      scrollFramePending = false;
    });
  };

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
  window.addEventListener("load", updateScrollUi);

  // 页面初次加载时立即同步一次状态。
  updateScrollUi();

  // -------------------------------------------------------------------------
  // 5. 返回顶部
  // -------------------------------------------------------------------------
  if (backToTop) {
    backToTop.addEventListener("click", () => {
      setMenuState(false);

      window.scrollTo({
        top: 0,
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
      });
    });
  }
})();
