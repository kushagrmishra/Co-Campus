import { Topic, TopicVideoGroup, YouTubeVideo } from '../types';

const YOUTUBE_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;

export async function fetchVideosForTopics(topics: Topic[]): Promise<TopicVideoGroup[]> {
    if (!YOUTUBE_API_KEY) {
        console.warn('EXPO_PUBLIC_YOUTUBE_API_KEY is missing. Skipping video search.');
        return topics.map((t) => ({ heading: t.heading, videos: [] }));
    }

    const results = await Promise.all(
        topics.map(async (topic) => {
            try {
                const searchQuery = `${topic.heading} explained`;
                const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&safeSearch=strict&q=${encodeURIComponent(
                    searchQuery
                )}&key=${YOUTUBE_API_KEY}`;

                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`YouTube API returned status ${res.status}`);
                }

                const data = await res.json();
                const videos: YouTubeVideo[] = (data.items || []).map((item: any) => ({
                    id: item.id?.videoId || item.id,
                    title: item.snippet?.title || 'Untitled',
                    thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
                    channelTitle: item.snippet?.channelTitle || '',
                }));

                return { heading: topic.heading, videos };
            } catch (error) {
                console.warn(`Failed to fetch YouTube videos for topic "${topic.heading}":`, error);
                return { heading: topic.heading, videos: [] };
            }
        })
    );

    return results;
}