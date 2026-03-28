import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Configuration affichage des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Demander la permission et récupérer le token
export async function enregistrerNotifications(
  clientId: number,
): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Notifications uniquement sur vrai appareil");
    return null;
  }

  // Demander permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Permission refusée");
    return null;
  }

  // Récupérer le token push
  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })
  ).data;

  console.log("Token push:", token);

  // Sauvegarder le token dans Supabase
  await supabase
    .from("clients")
    .update({ push_token: token })
    .eq("id", clientId);

  // Configuration Android
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "DSM Librairie",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2E86FF",
    });
  }

  return token;
}

// Envoyer une notification locale
export async function envoyerNotifLocale(titre: string, message: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titre,
      body: message,
      sound: true,
      data: { source: "DSM" },
    },
    trigger: null, // Immédiat
  });
}

// Envoyer notification à un client via Supabase
export async function envoyerNotifClient(
  clientId: number,
  titre: string,
  message: string,
) {
  await supabase.from("notifications").insert({
    client_id: clientId,
    titre,
    message,
    lu: false,
  });
}
