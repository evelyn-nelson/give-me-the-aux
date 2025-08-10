import React from "react";
import { useRouter } from "expo-router";
import { CreateGroupScreen } from "../components/CreateGroupScreen";

export default function CreateGroupRoute() {
  const router = useRouter();
  return (
    <CreateGroupScreen
      onGroupCreated={() => router.back()}
      onCancel={() => router.back()}
    />
  );
}
