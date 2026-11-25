import { feedResponse } from "../lib/feeds.js";

export const GET = () => feedResponse("/feed.xml");
