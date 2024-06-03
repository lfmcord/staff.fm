import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';

export class StaffMailCustomIds {
    public static Category = 'staff-mail-create-category';
    public static CancelButton = 'cancel';
    public static ReportSendButton = 'defer-staff-mail-create-' + StaffMailType.Report;
    public static ReportSendAnonButton = 'defer-staff-mail-create-' + StaffMailType.Report + '-anon';
    public static CrownsReportSendButton = 'defer-staff-mail-create-' + StaffMailType.CrownsReport;
    public static CrownsBanInquirySendButton = 'defer-staff-mail-create-' + StaffMailType.CrownsBanInquiry;
    public static CrownsFalseCrownSendButton = 'defer-staff-mail-create-' + StaffMailType.CrownsFalseCrown;
    public static CrownsOtherSendButton = 'defer-staff-mail-create-' + StaffMailType.CrownsOther;
    public static LastfmSendButton = 'defer-staff-mail-create-' + StaffMailType.Lastfm;
    public static ServerSendButton = 'defer-staff-mail-create-' + StaffMailType.Server;
    public static OtherSendButton = 'defer-staff-mail-create-' + StaffMailType.Other;
    public static OtherSendAnonButton = 'defer-staff-mail-create-' + StaffMailType.Other + '-anon';

    public static InServerReportSendButton = 'defer-staff-mail-create-' + StaffMailType.InServerReport;
    public static InServerReportSendAnonButton = 'defer-staff-mail-create-' + StaffMailType.InServerReport + '-anon';

    public static UrgentReportSendButton = 'staff-mail-create-' + StaffMailType.UrgentReport;
    public static UrgentReportSendAnonButton = 'staff-mail-create-' + StaffMailType.UrgentReport + '-anon';

    public static ContactMemberSend = 'contact-member-send';
    public static ContactMemberSendAnon = 'contact-member-send-anon';
    public static ContactMemberCancel = 'contact-member-cancel';
}
