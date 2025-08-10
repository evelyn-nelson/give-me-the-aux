import React from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import {
  createStackNavigator,
  StackScreenProps,
} from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";

import { GroupListScreen } from "./GroupListScreen";
import { CreateGroupScreen } from "./CreateGroupScreen";
import { GroupDetailScreen } from "./GroupDetailScreen";
import { CreateRoundScreen } from "./CreateRoundScreen";
import { RoundDetailScreen } from "./RoundDetailScreen";
import { EditGroupScreen } from "./EditGroupScreen";
import { SubmitSongScreen } from "./SubmitSongScreen";
import { SettingsScreen } from "./SettingsScreen";
import { Group, Round, Submission } from "../types/api";

export type GroupsStackParamList = {
  GroupList: undefined;
  CreateGroup: undefined;
  GroupDetail: { group: Group };
  CreateRound: { groupId: string; groupName: string };
  RoundDetail: { round: Round; group: Group };
  SubmitSong: { round: Round; group: Group; existingSubmission?: Submission };
  EditGroup: { group: Group };
  Settings: undefined;
};

const Stack = createStackNavigator<GroupsStackParamList>();

export const GroupsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="GroupList" component={GroupListWrapper} />
      <Stack.Screen name="CreateGroup" component={CreateGroupWrapper} />
      <Stack.Screen name="GroupDetail" component={GroupDetailWrapper} />
      <Stack.Screen name="CreateRound" component={CreateRoundWrapper} />
      <Stack.Screen name="RoundDetail" component={RoundDetailWrapper} />
      <Stack.Screen name="SubmitSong" component={SubmitSongWrapper} />
      <Stack.Screen name="EditGroup" component={EditGroupWrapper} />
      <Stack.Screen name="Settings" component={SettingsWrapper} />
    </Stack.Navigator>
  );
};

type GroupListProps = StackScreenProps<GroupsStackParamList, "GroupList">;
const GroupListWrapper: React.FC<GroupListProps> = ({ navigation }) => (
  <GroupListScreen
    onGroupPress={(group) => navigation.navigate("GroupDetail", { group })}
    onCreateGroupPress={() => navigation.navigate("CreateGroup")}
    onOpenSettings={() => navigation.navigate("Settings")}
  />
);

type CreateGroupProps = StackScreenProps<GroupsStackParamList, "CreateGroup">;
const CreateGroupWrapper: React.FC<CreateGroupProps> = ({ navigation }) => (
  <CreateGroupScreen
    onGroupCreated={() => navigation.goBack()}
    onCancel={() => navigation.goBack()}
  />
);

type GroupDetailProps = StackScreenProps<GroupsStackParamList, "GroupDetail">;
const GroupDetailWrapper: React.FC<GroupDetailProps> = ({
  navigation,
  route,
}) => {
  const { group } = route.params;
  return (
    <GroupDetailScreen
      group={group}
      onBack={() => navigation.goBack()}
      onRoundPress={(round) =>
        navigation.navigate("RoundDetail", { round, group })
      }
      onCreateRoundPress={(groupId) =>
        navigation.navigate("CreateRound", { groupId, groupName: group.name })
      }
      onEditGroupPress={(g) => navigation.navigate("EditGroup", { group: g })}
    />
  );
};

type CreateRoundProps = StackScreenProps<GroupsStackParamList, "CreateRound">;
const CreateRoundWrapper: React.FC<CreateRoundProps> = ({
  navigation,
  route,
}) => {
  const { groupId, groupName } = route.params;
  return (
    <CreateRoundScreen
      groupId={groupId}
      groupName={groupName}
      onRoundCreated={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
};

type RoundDetailProps = StackScreenProps<GroupsStackParamList, "RoundDetail">;
const RoundDetailWrapper: React.FC<RoundDetailProps> = ({
  navigation,
  route,
}) => {
  const { round, group } = route.params;
  return (
    <RoundDetailScreen
      round={round}
      group={group}
      onBack={() => navigation.goBack()}
      onSubmitSongPress={(_roundId, existingSubmission) =>
        navigation.navigate("SubmitSong", { round, group, existingSubmission })
      }
      onEditRoundPress={(updatedRound) =>
        navigation.setParams({ round: updatedRound } as any)
      }
    />
  );
};

type SubmitSongProps = StackScreenProps<GroupsStackParamList, "SubmitSong">;
const SubmitSongWrapper: React.FC<SubmitSongProps> = ({
  navigation,
  route,
}) => {
  const { round, group, existingSubmission } = route.params;
  return (
    <SubmitSongScreen
      round={round}
      group={group}
      existingSubmission={existingSubmission}
      onBack={() => navigation.goBack()}
      onSuccess={() => navigation.goBack()}
    />
  );
};

type EditGroupProps = StackScreenProps<GroupsStackParamList, "EditGroup">;
const EditGroupWrapper: React.FC<EditGroupProps> = ({ navigation, route }) => {
  const { group } = route.params;
  return (
    <EditGroupScreen
      group={group}
      onGroupUpdated={(updatedGroup) =>
        navigation.navigate("GroupDetail", { group: updatedGroup })
      }
      onCancel={() => navigation.goBack()}
    />
  );
};

type SettingsProps = StackScreenProps<GroupsStackParamList, "Settings">;
const SettingsWrapper: React.FC<SettingsProps> = ({ navigation }) => (
  <View style={styles.container}>
    <View style={styles.settingsHeader}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Back to groups"
      >
        <Ionicons name="chevron-back" size={20} color="#FFB000" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.settingsTitle}>Settings</Text>
    </View>
    <SettingsScreen />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  backButton: {
    padding: 8,
    marginRight: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backButtonText: {
    color: "#FFB000",
    fontSize: 16,
    fontWeight: "500",
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
});
