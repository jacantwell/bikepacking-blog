import Container from "@/app/_components/container";
import { Intro } from "@/app/_components/intro";
import { MoreStories } from "@/app/_components/more-stories";
import { JourneyMap } from "@/app/_components/journey-map";
import { getAllPosts } from "@/lib/api";
import { getJourneyActivities } from "@/app/_actions/strava";

export default async function Index() {
  const allPosts = getAllPosts();
  const morePosts = allPosts.slice(1);
  
  // Set the journey start date - this would be configurable
  const journeyStartDate = process.env.JOURNEY_START_DATE || '2025-03-01T00:00:00Z';
  
  // Fetch Strava activities (currently mock data)
  const { activities, startDate } = await getJourneyActivities(journeyStartDate);

  return (
    <main>
      <Container>
        <Intro />
        {/* Replace HeroPost with JourneyMap */}
        <JourneyMap activities={activities} startDate={startDate} />
        {morePosts.length > 0 && <MoreStories posts={morePosts} />}
      </Container>
    </main>
  );
}