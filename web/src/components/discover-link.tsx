"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

type DiscoverLinkProps = Omit<ComponentProps<typeof Link>, "href">;

export function DiscoverLink({ onClick, ...props }: DiscoverLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      window.location.pathname !== "/"
    ) {
      return;
    }

    const target = document.getElementById("discover");
    if (!target) {
      return;
    }

    event.preventDefault();
    const normalizedUrl = `${window.location.pathname}${window.location.search}#discover`;
    if (window.location.hash !== "#discover") {
      const updateHistory = window.location.hash
        ? window.history.replaceState.bind(window.history)
        : window.history.pushState.bind(window.history);
      updateHistory(window.history.state, "", normalizedUrl);
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <Link {...props} href="/#discover" onClick={handleClick} />;
}
