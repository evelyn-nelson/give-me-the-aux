import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { GroupListScreen } from "./GroupListScreen";
import { CreateGroupScreen } from "./CreateGroupScreen";
import { GroupDetailScreen } from "./GroupDetailScreen";
import { CreateRoundScreen } from "./CreateRoundScreen";
import { RoundDetailScreen } from "./RoundDetailScreen";
import { Group, Round } from "../types/api";

type ScreenType =
  | "list"
  | "create-group"
  | "group-detail"
  | "create-round"
  | "round-detail";

interface ScreenState {
  screen: ScreenType;
  selectedGroup?: Group;
  selectedRound?: Round;
  createRoundGroupId?: string;
  createRoundGroupName?: string;
}

export const GroupsNavigator: React.FC = () => {
  const [screenState, setScreenState] = useState<ScreenState>({
    screen: "list",
  });

  const navigateToGroupList = () => {
    setScreenState({ screen: "list" });
  };

  const navigateToCreateGroup = () => {
    setScreenState({ screen: "create-group" });
  };

  const navigateToGroupDetail = (group: Group) => {
    setScreenState({
      screen: "group-detail",
      selectedGroup: group,
    });
  };

  const navigateToCreateRound = (groupId: string, groupName: string) => {
    setScreenState({
      screen: "create-round",
      createRoundGroupId: groupId,
      createRoundGroupName: groupName,
    });
  };

  const navigateToRoundDetail = (round: Round) => {
    setScreenState({
      screen: "round-detail",
      selectedRound: round,
    });
  };

  const handleGroupCreated = () => {
    // TODO: Refresh groups list
    navigateToGroupList();
  };

  const handleRoundCreated = () => {
    // TODO: Refresh group detail
    if (screenState.selectedGroup) {
      navigateToGroupDetail(screenState.selectedGroup);
    } else {
      navigateToGroupList();
    }
  };

  const handleGroupEdited = (group: Group) => {
    // TODO: Navigate to edit group screen (not implemented yet)
    console.log("Edit group:", group.name);
  };

  const handleRoundEdited = (round: Round) => {
    // TODO: Navigate to edit round screen (not implemented yet)
    console.log("Edit round:", round.theme);
  };

  const handleSubmitSong = (roundId: string) => {
    // TODO: Navigate to submit song screen (not implemented yet)
    console.log("Submit song for round:", roundId);
  };

  const renderCurrentScreen = () => {
    switch (screenState.screen) {
      case "list":
        return (
          <GroupListScreen
            onGroupPress={navigateToGroupDetail}
            onCreateGroupPress={navigateToCreateGroup}
          />
        );

      case "create-group":
        return (
          <CreateGroupScreen
            onGroupCreated={handleGroupCreated}
            onCancel={navigateToGroupList}
          />
        );

      case "group-detail":
        if (!screenState.selectedGroup) return null;
        return (
          <GroupDetailScreen
            group={screenState.selectedGroup}
            onBack={navigateToGroupList}
            onRoundPress={navigateToRoundDetail}
            onCreateRoundPress={(groupId) =>
              navigateToCreateRound(groupId, screenState.selectedGroup!.name)
            }
            onEditGroupPress={handleGroupEdited}
          />
        );

      case "create-round":
        if (
          !screenState.createRoundGroupId ||
          !screenState.createRoundGroupName
        )
          return null;
        return (
          <CreateRoundScreen
            groupId={screenState.createRoundGroupId}
            groupName={screenState.createRoundGroupName}
            onRoundCreated={handleRoundCreated}
            onCancel={() => {
              if (screenState.selectedGroup) {
                navigateToGroupDetail(screenState.selectedGroup);
              } else {
                navigateToGroupList();
              }
            }}
          />
        );

      case "round-detail":
        if (!screenState.selectedRound) return null;
        return (
          <RoundDetailScreen
            round={screenState.selectedRound}
            onBack={() => {
              if (screenState.selectedGroup) {
                navigateToGroupDetail(screenState.selectedGroup);
              } else {
                navigateToGroupList();
              }
            }}
            onSubmitSongPress={handleSubmitSong}
            onEditRoundPress={handleRoundEdited}
          />
        );

      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderCurrentScreen()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
});
