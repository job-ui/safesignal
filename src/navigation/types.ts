export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type AppStackParamList = {
  RoleSelect: undefined;
  MonitorNav: undefined;
  MonitoredNav: undefined;
};

export type MonitorStackParamList = {
  MonitorTabs: undefined;
  ContactDetail: {
    pairId: string;
    monitoredId: string;
  };
  AddContactModal: undefined;
  EmergencyModal: {
    pairId: string;
    monitoredId: string;
    contactName: string;
  };
};
