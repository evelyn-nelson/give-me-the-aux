import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { GroupListScreen } from "./GroupListScreen";
import { CreateGroupScreen } from "./CreateGroupScreen";
import { GroupDetailScreen } from "./GroupDetailScreen";
import { CreateRoundScreen } from "./CreateRoundScreen";
import { RoundDetailScreen } from "./RoundDetailScreen";
import { EditGroupScreen } from "./EditGroupScreen";
import { Group, Round } from "../types/api";

type ScreenType =
  | "list"
  | "create-group"
  | "group-detail"
  | "create-round"
  | "round-detail"
  | "edit-group";

interface ScreenState {
  screen: ScreenType;
  selectedGroup?: Group;
  selectedRound?: Round;
  createRoundGroupId?: string;
  createRoundGroupName?: string;
  editingGroup?: Group;
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
      selectedGroup: screenState.selectedGroup, // Preserve the current group
    });
  };

  const navigateToRoundDetail = (round: Round) => {
    setScreenState({
      screen: "round-detail",
      selectedRound: round,
      selectedGroup: screenState.selectedGroup, // Preserve the current group
    });
  };

  const handleGroupCreated = () => {
    // TODO: Refresh groups list
    navigateToGroupList();
  };

  const handleGroupUpdated = (updatedGroup: Group) => {
    // Update the selected group with the updated data
    if (screenState.selectedGroup?.id === updatedGroup.id) {
      setScreenState((prev) => ({
        ...prev,
        selectedGroup: updatedGroup,
      }));
    }
    // Navigate back to group detail with the updated group
    navigateToGroupDetail(updatedGroup);
  };

  const handleRoundCreated = () => {
    // Navigate back to group detail - the query invalidation in useCreateRound
    // will automatically refresh the group data, and GroupDetailScreen will fetch fresh data
    if (screenState.selectedGroup) {
      navigateToGroupDetail(screenState.selectedGroup);
    } else {
      navigateToGroupList();
    }
  };

  const navigateToEditGroup = (group: Group) => {
    setScreenState({
      screen: "edit-group",
      editingGroup: group,
      selectedGroup: screenState.selectedGroup, // Preserve the current group
    });
  };

  const handleGroupEdited = (group: Group) => {
    navigateToEditGroup(group);
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
              // Always go back to the group detail since we're creating a round for that group
              if (screenState.selectedGroup) {
                navigateToGroupDetail(screenState.selectedGroup);
              } else {
                // Fallback: create a minimal group object to navigate back
                navigateToGroupDetail({
                  id: screenState.createRoundGroupId!,
                  name: screenState.createRoundGroupName!,
                  adminId: "", // We don't have this info, but it's not used for navigation
                  createdAt: new Date().toISOString(),
                  submissionDurationDays: 3,
                  votingDurationDays: 2,
                  votesPerUserPerRound: 10,
                  maxVotesPerSong: 3,
                  admin: { id: "", displayName: "" },
                  members: [],
                  rounds: [],
                  _count: { members: 0, rounds: 0 },
                });
              }
            }}
          />
        );

      case "round-detail":
        if (!screenState.selectedRound || !screenState.selectedGroup)
          return null;
        return (
          <RoundDetailScreen
            round={screenState.selectedRound}
            group={screenState.selectedGroup}
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

      case "edit-group":
        if (!screenState.editingGroup) return null;
        return (
          <EditGroupScreen
            group={screenState.editingGroup}
            onGroupUpdated={handleGroupUpdated}
            onCancel={() => {
              // Always go back to the group detail since we're editing that group
              if (screenState.selectedGroup) {
                navigateToGroupDetail(screenState.selectedGroup);
              } else {
                // Fallback: create a minimal group object to navigate back
                const editingGroup = screenState.editingGroup!;
                navigateToGroupDetail({
                  id: editingGroup.id,
                  name: editingGroup.name,
                  adminId: editingGroup.adminId,
                  createdAt: editingGroup.createdAt,
                  submissionDurationDays: editingGroup.submissionDurationDays,
                  votingDurationDays: editingGroup.votingDurationDays,
                  votesPerUserPerRound: editingGroup.votesPerUserPerRound,
                  maxVotesPerSong: editingGroup.maxVotesPerSong,
                  admin: editingGroup.admin,
                  members: editingGroup.members,
                  rounds: editingGroup.rounds,
                  _count: editingGroup._count,
                });
              }
            }}
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
