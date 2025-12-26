const heroVideo = document.querySelector(".hero-video");
const soundToggle = document.querySelector(".sound-toggle");

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

const latestVideos = document.getElementById("latestVideos");
const latestVideosStatus = document.getElementById("latestVideosStatus");
const videosMoreButton = document.getElementById("videosMore");

if (latestVideos && latestVideosStatus) {
  const channelId = latestVideos.dataset.channelId || "";
  const maxResults = Number.parseInt(latestVideos.dataset.maxResults || "5", 10) || 5;
  const loadingText = latestVideosStatus.dataset.loadingText || "Loading videos...";
  const emptyText = latestVideosStatus.dataset.emptyText || "No videos found.";
  const errorText = latestVideosStatus.dataset.errorText || "Unable to load videos.";
  const initialCount = 2;

  latestVideosStatus.textContent = loadingText;

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

  const parseFeed = (xmlText) => {
    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
    const entries = Array.from(xml.querySelectorAll("entry"));
    return entries.map((entry) => {
      const title = safeText(entry.querySelector("title")?.textContent);
      const videoId = safeText(entry.querySelector("yt\\:videoId")?.textContent)
        || safeText(entry.querySelector("videoId")?.textContent);
      const link = entry.querySelector("link[rel=\"alternate\"]")?.getAttribute("href")
        || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
      const thumbnail = entry.querySelector("media\\:thumbnail")?.getAttribute("url") || "";
      const published = safeText(entry.querySelector("published")?.textContent);
      const updated = safeText(entry.querySelector("updated")?.textContent);
      return {
        title,
        videoId,
        url: link,
        thumbnail,
        date: published || updated,
      };
    }).filter((entry) => entry.url);
  };

  const fetchFeedText = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  };

  const loadLatestVideos = async () => {
    if (!channelId) {
      latestVideosStatus.textContent = errorText;
      return;
    }

    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;

    let xmlText = "";
    try {
      xmlText = await fetchFeedText(feedUrl);
    } catch (error) {
      try {
        xmlText = await fetchFeedText(proxyUrl);
      } catch (proxyError) {
        latestVideosStatus.textContent = errorText;
        return;
      }
    }

    const videos = parseFeed(xmlText).slice(0, maxResults);
    if (!videos.length) {
      latestVideosStatus.textContent = emptyText;
      if (videosMoreButton) {
        videosMoreButton.hidden = true;
      }
      return;
    }

    const initialVideos = videos.slice(0, initialCount);
    const remainingVideos = videos.slice(initialCount);

    latestVideos.textContent = "";
    initialVideos.forEach((video) => {
      latestVideos.appendChild(buildCard(video));
    });
    latestVideosStatus.classList.add("is-hidden");

    if (videosMoreButton) {
      videosMoreButton.hidden = remainingVideos.length === 0;
      if (remainingVideos.length > 0) {
        videosMoreButton.addEventListener("click", () => {
          remainingVideos.forEach((video) => {
            latestVideos.appendChild(buildCard(video));
          });
          videosMoreButton.hidden = true;
        }, { once: true });
      }
    }
  };

  loadLatestVideos();
}
