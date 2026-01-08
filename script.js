const heroVideo = document.querySelector(".hero-video");
const soundToggle = document.querySelector(".sound-toggle");
const heroSources = heroVideo
  ? Array.from(heroVideo.querySelectorAll('source[type="video/mp4"]'))
      .map((source) => source.getAttribute("src"))
      .filter(Boolean)
  : [];
const canPlayMp4 = heroVideo ? heroVideo.canPlayType("video/mp4") : "";

if (heroVideo && heroSources.length > 1 && canPlayMp4 !== "") {
  heroVideo.loop = false;
  let heroIndex = 0;
  const setHeroSource = (index) => {
    heroIndex = (index + heroSources.length) % heroSources.length;
    heroVideo.src = heroSources[heroIndex];
    heroVideo.load();
    heroVideo.play().catch(() => {});
  };

  setHeroSource(0);
  heroVideo.addEventListener("ended", () => {
    setHeroSource(heroIndex + 1);
  });
}

if (heroVideo && soundToggle) {
  soundToggle.addEventListener("click", async () => {
    heroVideo.muted = false;
    heroVideo.volume = 1;
    try {
      await heroVideo.play();
    } catch (error) {
      console.warn("Unable to start video with sound:", error);
    }
    soundToggle.hidden = true;
    soundToggle.style.display = "none";
  });
}

const heroSection = document.querySelector(".hero-screen");
const siteHeader = document.querySelector(".site-header");
let pausedByScroll = false;

if (heroVideo && heroSection && "IntersectionObserver" in window) {
  const heroObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry) {
        return;
      }
      if (entry.isIntersecting) {
        if (pausedByScroll) {
          heroVideo.play().catch(() => {});
        }
        pausedByScroll = false;
        if (siteHeader) {
          siteHeader.classList.remove("is-hidden");
        }
      } else {
        heroVideo.pause();
        pausedByScroll = true;
        if (siteHeader) {
          siteHeader.classList.add("is-hidden");
        }
      }
    },
    { threshold: 0.1 }
  );
  heroObserver.observe(heroSection);
}

const videosGrid = document.getElementById("videosGrid");
const videosStatus = document.getElementById("videosStatus");
const videosMoreButton = document.getElementById("videosMore");
const videosTabs = Array.from(document.querySelectorAll(".videos-tab"));
const spotifyMoreButton = document.getElementById("spotifyMore");
const spotifyEpisodes = document.getElementById("spotifyEpisodes");

if (videosGrid && videosStatus) {
  const maxResults = Number.parseInt(videosGrid.dataset.maxResults || "5", 10) || 5;
  const loadingText = videosStatus.dataset.loadingText || "Loading videos...";
  const emptyText = videosStatus.dataset.emptyText || "No videos found.";
  const errorText = videosStatus.dataset.errorText || "Unable to load videos.";

  const videoCache = new Map();
  const expandedFeeds = new Set();

  const safeText = (value) => (value || "").trim();

  const formatDate = (value) => {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const buildCard = ({ title, url, thumbnail, date, videoId }) => {
    const card = document.createElement("article");
    card.className = "video-card";

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";

    const thumb = document.createElement("div");
    thumb.className = "video-thumb";

    const imageUrl = thumbnail || (videoId
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : "");
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = title || "YouTube video";
      img.loading = "lazy";
      img.decoding = "async";
      thumb.appendChild(img);
    }

    const meta = document.createElement("div");
    meta.className = "video-meta";

    const heading = document.createElement("h3");
    heading.textContent = title || "Untitled video";
    meta.appendChild(heading);

    const formattedDate = formatDate(date);
    if (formattedDate) {
      const time = document.createElement("time");
      time.dateTime = date;
      time.textContent = formattedDate;
      meta.appendChild(time);
    }

    link.append(thumb, meta);
    card.appendChild(link);
    return card;
  };

  const normalizeVideos = (payload) => {
    const rawVideos = Array.isArray(payload) ? payload : payload?.videos;
    return Array.isArray(rawVideos) ? rawVideos.map((entry) => {
      const title = safeText(entry?.title);
      const videoId = safeText(entry?.videoId);
      const url = safeText(entry?.url) || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
      const thumbnail = safeText(entry?.thumbnail) || (videoId
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : "");
      const date = safeText(entry?.date);
      return {
        title,
        videoId,
        url,
        thumbnail,
        date,
      };
    }).filter((entry) => entry.url) : [];
  };

  const fetchVideos = async (feedUrl) => {
    if (videoCache.has(feedUrl)) {
      return videoCache.get(feedUrl);
    }
    const separator = feedUrl.includes("?") ? "&" : "?";
    const requestUrl = `${feedUrl}${separator}v=${Date.now()}`;
    const response = await fetch(requestUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const videos = normalizeVideos(payload).slice(0, maxResults);
    videoCache.set(feedUrl, videos);
    return videos;
  };

  const getTabConfig = (tab) => {
    const feedUrl = tab?.dataset?.feedUrl || "latest-videos.json";
    const initialCount = Number.parseInt(tab?.dataset?.initialCount || "1", 10) || 1;
    return { feedUrl, initialCount };
  };

  const renderVideos = (feedUrl, videos, initialCount) => {
    const isExpanded = expandedFeeds.has(feedUrl);
    const visibleCount = isExpanded ? videos.length : Math.min(initialCount, videos.length);
    const visibleVideos = videos.slice(0, visibleCount);
    const remainingVideos = videos.slice(visibleCount);

    videosGrid.textContent = "";
    visibleVideos.forEach((video) => {
      videosGrid.appendChild(buildCard(video));
    });
    videosStatus.classList.add("is-hidden");

    if (videosMoreButton) {
      videosMoreButton.hidden = remainingVideos.length === 0;
      videosMoreButton.onclick = null;
      if (remainingVideos.length > 0) {
        videosMoreButton.onclick = () => {
          expandedFeeds.add(feedUrl);
          renderVideos(feedUrl, videos, initialCount);
        };
      }
    }
  };

  const setActiveTab = async (tab) => {
    if (!tab) {
      return;
    }
    videosTabs.forEach((button) => {
      const isActive = button === tab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const { feedUrl, initialCount } = getTabConfig(tab);
    videosStatus.textContent = loadingText;
    videosStatus.classList.remove("is-hidden");
    videosGrid.textContent = "";
    if (videosMoreButton) {
      videosMoreButton.hidden = true;
      videosMoreButton.onclick = null;
    }

    let videos = [];
    try {
      videos = await fetchVideos(feedUrl);
    } catch (error) {
      videosStatus.textContent = errorText;
      return;
    }

    if (!videos.length) {
      videosStatus.textContent = emptyText;
      if (videosMoreButton) {
        videosMoreButton.hidden = true;
      }
      return;
    }

    renderVideos(feedUrl, videos, initialCount);
  };

  if (videosTabs.length) {
    videosTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setActiveTab(tab);
      });
    });
  }

  const defaultTab = videosTabs.find((tab) => tab.classList.contains("is-active")) || videosTabs[0];
  setActiveTab(defaultTab);
}

if (spotifyMoreButton && spotifyEpisodes) {
  const allEpisodes = Array.from(spotifyEpisodes.querySelectorAll(".episode-player"));
  const initialCount = 3;

  const setSpotifyExpanded = (isExpanded) => {
    allEpisodes.forEach((episode, index) => {
      episode.hidden = !isExpanded && index >= initialCount;
    });
    const hasHidden = allEpisodes.length > initialCount;
    spotifyMoreButton.hidden = isExpanded || !hasHidden;
    spotifyMoreButton.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  };

  if (!allEpisodes.length) {
    spotifyMoreButton.hidden = true;
  } else {
    setSpotifyExpanded(false);
    if (allEpisodes.length > initialCount) {
      spotifyMoreButton.addEventListener("click", () => {
        setSpotifyExpanded(true);
      });
    }
  }
}

const quotesCarousel = document.querySelector(".quotes-carousel");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const isSmallScreen = window.matchMedia("(max-width: 768px)");

if (quotesCarousel && !prefersReducedMotion.matches && !isSmallScreen.matches) {
  const quoteItems = Array.from(quotesCarousel.children);
  if (quoteItems.length > 1 && !quotesCarousel.dataset.looping) {
    const track = document.createElement("div");
    track.className = "quotes-track";
    quoteItems.forEach((item) => {
      track.appendChild(item);
    });
    quoteItems.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
    quotesCarousel.textContent = "";
    quotesCarousel.appendChild(track);
    quotesCarousel.dataset.looping = "true";
    quotesCarousel.classList.add("is-looping");
    const durationSeconds = Math.max(quoteItems.length * 7, 32);
    quotesCarousel.style.setProperty("--marquee-duration", `${durationSeconds}s`);
  }
}

const revealTargets = document.querySelectorAll(".info-section, .logo-loop-section");
const revealReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (revealTargets.length) {
  revealTargets.forEach((section) => {
    section.classList.add("reveal-on-scroll");
  });

  if (revealReducedMotion.matches || !("IntersectionObserver" in window)) {
    revealTargets.forEach((section) => {
      section.classList.add("is-visible");
    });
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    revealTargets.forEach((section) => {
      revealObserver.observe(section);
    });
  }
}
