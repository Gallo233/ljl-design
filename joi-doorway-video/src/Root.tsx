import "./index.css";
import { Composition } from "remotion";
import {
  DoorwayPreviewVideo,
  IntroPhoneVideo,
  PeepholeJoiVideo,
} from "./Composition";
import { JoiMapReelVideo, JoiReelVideo } from "./ReelCompositions";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="IntroPhone"
        component={IntroPhoneVideo}
        durationInFrames={120}
        fps={30}
        width={720}
        height={1280}
      />
      <Composition
        id="PeepholeJoi"
        component={PeepholeJoiVideo}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="DoorwayPreview"
        component={DoorwayPreviewVideo}
        durationInFrames={420}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="JoiReel"
        component={JoiReelVideo}
        durationInFrames={48}
        fps={12}
        width={1024}
        height={768}
      />
      <Composition
        id="JoiMapReel"
        component={JoiMapReelVideo}
        durationInFrames={48}
        fps={12}
        width={1024}
        height={768}
      />
    </>
  );
};
