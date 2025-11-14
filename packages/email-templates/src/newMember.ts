export interface NewMemberEmailData {
    firstNamePl: string;
    firstNameEn: string;
    memberId: string;
  }
  
  export function renderNewMemberEmailHtml(data: NewMemberEmailData): string {
    const { firstNamePl, firstNameEn, memberId } = data;
  
    return `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Witaj ${firstNamePl}!</h2>
          <h3>Hi ${firstNameEn}!</h3>
          <p>Twój numer członkowski PSM / Your PSM Membership ID:</p>
          <p><strong>${memberId}</strong></p>
        </body>
      </html>
    `;
  }
  