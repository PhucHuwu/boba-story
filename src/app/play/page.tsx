import type { Metadata } from "next";
import GameApp from "@/presentation/ui/GameApp";

export const metadata: Metadata = {
  title: "Chơi Boba Story",
};

export default function PlayPage() {
  return <GameApp />;
}
